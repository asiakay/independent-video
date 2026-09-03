import type { Channel, ChannelId } from "./channel";
import type { CreatorId } from "../creator/creator";

export interface ChannelRepository {
  findById(id: ChannelId): Promise<Channel | null>;
  findBySlug(slug: string): Promise<Channel | null>;
  listByCreator(creatorId: CreatorId): Promise<Channel[]>;
  save(channel: Channel): Promise<void>;
}
