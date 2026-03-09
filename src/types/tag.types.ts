export interface CreateTagDTO {
  name: string;
  slug?: string;
  color?: string;
}

export interface UpdateTagDTO {
  name?: string;
  slug?: string;
  color?: string;
}

export interface TagListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface TagResponse {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagListResponse {
  data: TagResponse[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
