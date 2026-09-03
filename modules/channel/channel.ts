import type { CreatorId } from "../creator/creator";

export type ChannelId = string;

export interface Channel {
  id: ChannelId;
  creatorId: CreatorId;
  slug: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
