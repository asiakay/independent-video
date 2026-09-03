import type { Creator, CreatorId } from "./creator";

export interface CreatorRepository {
  findById(id: CreatorId): Promise<Creator | null>;
  findByHandle(handle: string): Promise<Creator | null>;
  save(creator: Creator): Promise<void>;
}
