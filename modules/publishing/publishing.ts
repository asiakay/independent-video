export interface PublishVideoInput {
  videoId: string;
  slug: string;
  title: string;
  description?: string;
}

export interface PublishVideoResult {
  videoId: string;
  canonicalPath: string;
  publishedAt: string;
}

export interface PublishingService {
  publish(input: PublishVideoInput): Promise<PublishVideoResult>;
}
