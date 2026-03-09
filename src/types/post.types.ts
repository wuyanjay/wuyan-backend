import { PostStatus } from '@prisma/client';

export interface CreatePostDTO {
  title: string;
  content: any;  // Tiptap JSON
  excerpt?: string;
  coverImage?: string;
  categoryId?: string;
  tags?: string[];  // tag IDs
  status?: PostStatus;
}

export interface UpdatePostDTO {
  title?: string;
  content?: any;
  excerpt?: string;
  coverImage?: string;
  categoryId?: string;
  tags?: string[]; // tag IDs
  status?: PostStatus;
}

export interface PostListQuery {
  page?: number;
  pageSize?: number;
  status?: PostStatus;
  categoryId?: string;
  tagId?: string;
  authorId?: string;
  search?: string;
}

export interface PostResponse {
  id: string;
  title: string;
  slug: string;
  content: any;
  excerpt: string | null;
  coverImage: string | null;
  status: PostStatus;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
  }[];
}
