export interface CreateCommentDTO {
  content: string;
  postId: string;
  parentId?: string;  // 回复评论时提供
}

export interface CommentResponse {
  id: string;
  content: string;
  likeCount: number;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    username: string;
    nickname: string | null;
    avatar: string | null;
  };
  parent: {
    id: string;
    author: {
      username: string;
    };
  } | null;
  replies: CommentResponse[];  // 二级回复
}
