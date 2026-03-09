import { Role } from '@prisma/client';

export interface CreateUserDTO {
  email: string;
  username: string;
  password: string;
  role?: Role;
  nickname?: string;
  avatar?: string;
  bio?: string;
}

export interface UpdateUserDTO {
  email?: string;
  username?: string;
  password?: string;
  role?: Role;
  nickname?: string;
  avatar?: string;
  bio?: string;
  emailVerified?: boolean;
  accountLocked?: boolean;
}

export interface UserListQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
  role?: Role;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  role: string;
  nickname: string | null;
  avatar: string | null;
  bio: string | null;
  emailVerified: boolean;
  accountLocked: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
