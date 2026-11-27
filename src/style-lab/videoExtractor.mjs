// Fatia 12c — Extrator de DNA de Vídeo MP4 (FFmpeg scene detection + Keyframes + Vision).
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { dnaToBrandKit } from './dna.mjs';
import { extractStyleFromImage } from './imageExtractor.mjs';

const run = promisify(execFile);
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export function parseSceneTimestamps(stderrText) {
  const cuts = [];
  const re = /pts_time:([0-9]+(?:\.[0-9]+)?)/g;
  let m;
  while ((m = re.exec(String(stderrText || ''))) !== null) {
    const t = Number(m[1]);
    if (Number.isFinite(t) && t > 0.15) cuts.push(Number(t.toFixed(2)));
  }
  return cuts;
}

export function computeVideoPace(durationSec, cutTimestamps = []) {
  const duration = Math.max(0, Number(durationSec) || 0);
  const cuts = [...cutTimestamps].filter((t) => t > 0.15 && t < duration - 0.1).sort((a, b) => a - b);
  const scenesCount = cuts.length + 1;
  const rawAvg = duration / scenesCount;
  const avgSceneSeconds = Number(rawAvg.toFixed(2));
  const pace = avgSceneSeconds <= 3.0 ? 'fast' : avgSceneSeconds <= 6.5 ? 'medium' : 'cinematic';
  const transitionFrames = pace === 'fast' ? 6 : pace === 'medium' ? 10 : 16;
  return {
    duration_s: Number(duration.toFixed(2)),
    cut_count: cuts.length,
    cut_timestamps: cuts.slice(0, 60),
    avg_scene_seconds: avgSceneSeconds,
    pace,
    transition_frames: transitionFrames,
  };
}

export async function extractStyleFromVideo(videoBuffer, {
  filename = 'referencia.mp4',
  sceneThreshold = 0.3,
  apiKey,
  fetchImpl = fetch,
  imageExtractor = extractStyleFromImage,
} = {}) {
  if (!Buffer.isBuffer(videoBuffer) || videoBuffer.length < 64) {
    throw new Error('Envie um arquivo de vídeo MP4 válido.');
  }
  if (videoBuffer.length > MAX_VIDEO_BYTES) {
    throw new Error('Vídeo excede o limite de 25 MB.');
  }

  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
  const ffprobe = process.env.FFPROBE_PATH || 'ffprobe';
  const dir = await mkdtemp(path.join(tmpdir(), 'svp-vid-'));
  try {
    const videoPath = path.join(dir, 'input.mp4');
    await writeFile(videoPath, videoBuffer);

    let durationSec;
    try {
      const { stdout } = await run(ffprobe, [
        '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=format_name,duration:stream=codec_type', '-of', 'json', '-protocol_whitelist', 'file,pipe', videoPath,
      ], { timeout: 15000 });
      const { format, streams } = JSON.parse(stdout);
      durationSec = Number(format?.duration);
      if (!format?.format_name?.split(',').includes('mp4') || !streams?.length || !(durationSec > 0)) throw new Error();

    } catch {
      throw new Error('Não foi possível ler os metadados do vídeo MP4 via ffprobe.');
    }

    if (durationSec > 180) throw new Error('Envie um vídeo de até 3 minutos.');

    // 1. Detecção real de cortes de cena via FFmpeg
    let sceneStderr = '';
    try {
      const res = await run(ffmpeg, [
        '-hide_banner', '-nostdin', '-protocol_whitelist', 'file,pipe', '-i', videoPath,
        '-map', '0:v:0', '-an', '-vf', `scale=320:-2,select='gt(scene,${sceneThreshold})',showinfo`,
        '-vsync', 'vfr', '-f', 'null', '-',
      ], { timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
      sceneStderr = res.stderr || '';
    } catch {
      throw new Error('Falha ao analisar cortes do vídeo com FFmpeg.');
    }

    const cuts = parseSceneTimestamps(sceneStderr);
    const teaserMetrics = computeVideoPace(durationSec, cuts);

    // 2. Extração de até 3 keyframes representativos
    const boundaries = [0, ...teaserMetrics.cut_timestamps, durationSec];
    const sceneCount = boundaries.length - 1;
    const samplePoints = [...new Set([0, Math.floor(sceneCount / 2), sceneCount - 1])]
      .map((index) => (boundaries[index] + boundaries[index + 1]) / 2);
    const keyframes = [];
    for (let i = 0; i < samplePoints.length; i++) {
      const outPath = path.join(dir, `keyframe-${i}.jpg`);
      try {
        await run(ffmpeg, [
          '-hide_banner', '-loglevel', 'error', '-nostdin',
          '-ss', samplePoints[i].toFixed(2), '-protocol_whitelist', 'file,pipe', '-i', videoPath,
          '-frames:v', '1', '-q:v', '4', '-vf', 'scale=640:-2', outPath,
        ], { timeout: 15000 });
        const buf = await readFile(outPath);
        if (buf.length > 0) keyframes.push({ time_s: Number(samplePoints[i].toFixed(2)), buffer: buf });
      } catch {
        // ignora keyframe fora do limite em vídeos muito curtos
      }
    }

    const primaryFrame = keyframes[1]?.buffer || keyframes[0]?.buffer;
    if (!primaryFrame) {
      throw new Error('Não foi possível extrair keyframes do vídeo enviado.');
    }

    // 3. Análise visual do keyframe principal (Gemini Vision ou fallback cromático local)
    const vision = await imageExtractor(primaryFrame, {
      mimeType: 'image/jpeg',
      filename: `${path.basename(filename, path.extname(filename))}-keyframe.jpg`,
      apiKey,
      fetchImpl,
    });

    const cleanName = path.basename(String(filename || 'video.mp4')).replace(/\.[^.]+$/, '').slice(0, 35) || 'Ritmo de Vídeo';
    const suggestedName = vision.origem === 'gemini-vision' ? vision.suggested_name : `Vídeo · ${cleanName}`;
    const dna = {
      ...vision.dna,
      source_type: 'video',
      source_ref: path.basename(String(filename || 'referencia.mp4')),
      teaser: teaserMetrics,
      keyframes_extracted: keyframes.length,
      keyframes_preview: keyframes.slice(0, 3).map((kf) => ({
        time_s: kf.time_s,
        data_url: `data:image/jpeg;base64,${kf.buffer.toString('base64')}`,
      })),
    };
    const brand_kit = dnaToBrandKit({ name: suggestedName, dna });

    return {
      origem: vision.origem === 'gemini-vision' ? 'ffmpeg+gemini-vision' : 'ffmpeg+local-palette',
      suggested_name: suggestedName,
      dna,
      brand_kit,
      warnings: vision.warnings,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
