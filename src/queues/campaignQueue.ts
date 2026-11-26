import { randomUUID } from 'node:crypto';
import { artDirectorAgent, type ArtDirectorOptions } from '../agents/artDirectorAgent.ts';
import { mediaProducerAgent } from '../agents/mediaProducerAgent.ts';
import { qaReviewerAgent, type QaReviewerOptions } from '../agents/qaReviewerAgent.ts';
import { showcaseBuilderAgent } from '../agents/showcaseBuilderAgent.ts';
import type { MediaProvider } from '../services/ai-media/types.ts';
import type { CampaignBriefInput, PipelineJob } from '../types/campaign.ts';

export interface CampaignQueueDeps {
  mediaProvider: MediaProvider;
  artDirectorOptions?: ArtDirectorOptions;
  qaReviewerOptions?: QaReviewerOptions;
}

/**
 * Fila assíncrona em memória para orquestrar o pipeline em 3 etapas:
 * QUEUED -> ART_DIRECTION -> MEDIA_PRODUCTION -> SHOWCASE_READY (ou FAILED_RETRYABLE).
 */
export class CampaignQueue {
  private readonly jobs = new Map<string, PipelineJob>();
  private readonly deps: CampaignQueueDeps;

  constructor(deps: CampaignQueueDeps) {
    this.deps = deps;
  }

  enqueue(brief: CampaignBriefInput): PipelineJob {
    const now = new Date().toISOString();
    const job: PipelineJob = {
      id: randomUUID(),
      status: 'QUEUED',
      brief,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  getJob(id: string): PipelineJob | undefined {
    return this.jobs.get(id);
  }

  async runJob(id: string): Promise<PipelineJob> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job não encontrado: ${id}`);

    try {
      job.status = 'ART_DIRECTION';
      job.updatedAt = new Date().toISOString();
      job.artDirection = await artDirectorAgent(job.brief, this.deps.artDirectorOptions);

      job.status = 'MEDIA_PRODUCTION';
      job.updatedAt = new Date().toISOString();
      job.production = await mediaProducerAgent(job.artDirection, this.deps.mediaProvider);

      job.status = 'QA_REVIEW';
      job.updatedAt = new Date().toISOString();
      job.qaReview = await qaReviewerAgent(job.production, this.deps.qaReviewerOptions);

      job.showcase = showcaseBuilderAgent(job.production);
      job.status = 'SHOWCASE_READY';
      job.updatedAt = new Date().toISOString();
      return job;
    } catch (err) {
      job.status = 'FAILED_RETRYABLE';
      job.error = err instanceof Error ? err.message : String(err);
      job.updatedAt = new Date().toISOString();
      return job;
    }
  }
}
