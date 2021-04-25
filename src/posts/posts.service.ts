import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoriesService } from 'src/categories/categories.service';
import { User } from 'src/users/entities/users.entity';
import { Repository } from 'typeorm';
import { CreatePostInput } from './interfaces/create-post.dto';
import { Post } from './entities/posts.entity';
import { PostTag } from './entities/postTags.entity';
import { Tag } from './entities/tags.entity';
import { DeletePostInput } from './interfaces/delete-post.dto';
import { UpdatePostInput } from './interfaces/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly postRepository: Repository<Post>,
    @InjectRepository(Tag) private readonly tagRepository: Repository<Tag>,
    @InjectRepository(PostTag)
    private readonly posttagsRepository: Repository<PostTag>,
    private readonly categoriesservice: CategoriesService,
  ) {}

  /**
   * 전체 포스토 조회
   * @returns post[]
   */
  async getPosts() {
    const find = await this.postRepository.find();
    return find;
  }

  async getPost(id: number) {
    const post = await this.postRepository.findOne({ id });
    if (!post) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: '존재하지 않는 포스트입니다..',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      success: true,
      post: post,
    };
  }

  /**
   * 포스트 생성
   * @param user
   * @param post
   */
  async createPost(user: User, post: CreatePostInput) {
    const category = await this.categoriesservice.findByName(post.categoryName);
    if (!category) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: '존재하지 않는 카테고리입니다.',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    try {
      const newPost = this.postRepository.create(post);
      const slug_title = post.title.replace(/ /g, '-');
      newPost.user = user;
      newPost.category = category;
      newPost.slug = slug_title;
      const savePost = await this.postRepository.save(newPost);
      const tags = await Promise.all(
        post.tags.map((tag) => this.createTag(tag)),
      );
      tags.map((tag) => this.addTag(tag, savePost));

      return {
        success: true,
        post: savePost,
      };
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: e,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 포스트 업데이트
   * @param user
   * @param id
   * @param post
   */

  async updatePost(
    user: User,
    id: number,
    { tags, categoryName }: UpdatePostInput,
  ) {
    const post = await this.postRepository.findOne({ id });
    const category = await this.categoriesservice.findByName(categoryName);
    if (!category) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: '존재하지 않는 카테고리입니다.',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    if (!post) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: '포스트가 존재하지 않습니다.',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    if (user.id !== post.userId) {
      throw new HttpException(
        {
          status: HttpStatus.UNAUTHORIZED,
          error: '타인의 게시글을 수정 할수 없습니다.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const prevTags = await this.posttagsRepository.find({
      where: {
        postId: id,
      },
    });
    if (prevTags) {
      prevTags.map((tag) => this.deleteTag(tag.id));
      await this.postRepository.delete({ id });
    } else {
      await this.postRepository.delete({ id });
    }
    try {
      const newPost = this.postRepository.create(post);
      const slug_title = post.title.replace(/ /g, '-');
      newPost.user = user;
      newPost.category = category;
      newPost.slug = slug_title;
      const savePost = await this.postRepository.save(newPost);
      const updateTags = await Promise.all(
        tags.map((tag) => this.createTag(tag)),
      );
      updateTags.map((tag) => this.addTag(tag, savePost));

      return {
        success: true,
        post: savePost,
      };
    } catch (e) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: e,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 태그 추가
   * @param title
   */
  async createTag(title: string) {
    const tag = await this.tagRepository.findOne({ title });
    if (!tag) {
      const freshTag = new Tag();
      freshTag.title = title;
      return await this.tagRepository.save(freshTag);
    } else {
      return tag;
    }
  }

  /**
   * 포스트 태그 연결
   * @param tag
   * @param post
   */
  async addTag(tag: Tag, post: Post) {
    // const tag = await this.tagRepository.findOne({ title });
    console.log(tag);
    const postTags = this.posttagsRepository.create(new PostTag());
    postTags.tags = tag;
    postTags.post = post;
    return await this.posttagsRepository.save(postTags);
  }

  /**
   * 포스트 태그 조회
   * @param postId
   */
  async getPostTags(postId: number) {
    const PostTags = await this.posttagsRepository.find({ postId });
    console.log(PostTags);
    return PostTags;
  }

  /**
   * 회원이 쓴 포스트 조회
   * @param userId
   */
  async getPostByUserId(userId: number) {
    const UserPosts = await this.postRepository.find({
      where: {
        userId: userId,
      },
    });
    return UserPosts;
  }

  /**
   * 포스트 삭제
   * @param user
   * @param postId
   */
  async deletePost(user: User, { id }: DeletePostInput) {
    const post = await this.postRepository.findOne({ id });
    console.log(post);
    if (!post) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: '포스트가 존재하지 않습니다.',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    if (user.id !== post.userId) {
      throw new HttpException(
        {
          status: HttpStatus.UNAUTHORIZED,
          error: '타인의 게시글을 삭제 할수 없습니다.',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    const tags = await this.posttagsRepository.find({
      where: {
        postId: id,
      },
    });
    if (tags) {
      tags.map((tag) => this.deleteTag(tag.id));
      await this.postRepository.delete({ id });
    } else {
      await this.postRepository.delete({ id });
    }
    return {
      success: true,
    };
  }

  /**
   * 태그 삭제
   * @param id
   */
  async deleteTag(id: number) {
    return await this.posttagsRepository.delete({ id });
  }

  /**
   * 카테고리 포스트 조회
   * @param categoryId
   */
  async getCategoryPost(categoryId: number) {
    return await this.postRepository.find({
      where: {
        categoryId: categoryId,
      },
    });
  }
}
