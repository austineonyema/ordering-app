import { Logger, NotFoundException } from '@nestjs/common';
import {
  Model,
  Types,
  UpdateQuery,
  SaveOptions,
  Connection,
  type ClientSession,
  type QueryFilter,
  type ProjectionType,
} from 'mongoose';
import { AbstractDocument } from './abstract.schema';

export abstract class AbstractRepository<TDocument extends AbstractDocument> {
  protected abstract readonly logger: Logger;

  constructor(
    protected readonly model: Model<TDocument>,
    private readonly connection: Connection,
  ) {}

  async create(
    document: Omit<TDocument, '_id'>,
    options?: SaveOptions,
  ): Promise<TDocument> {
    const createdDocument = new this.model({
      ...document,
      _id: new Types.ObjectId(),
    });
    return (
      await createdDocument.save(options)
    ).toJSON() as unknown as TDocument;
  }

  async findOneOptional<TResult = TDocument>(
    filterQuery: QueryFilter<TDocument>,
    options?: {
      select?: ProjectionType<TDocument>;
    },
  ): Promise<TResult | null> {
    let query = this.model.findOne(filterQuery, {}, { lean: true });

    if (options?.select) {
      query = query.select(options.select);
    }

    return query.lean<TResult>().exec();
  }

  async findOne(filterQuery: QueryFilter<TDocument>): Promise<TDocument> {
    const document = await this.findOneOptional(filterQuery);

    if (!document) {
      this.logger.warn('Document not found with filterQuery', filterQuery);
      throw new NotFoundException('Document not found.');
    }

    return document;
  }

  async findOneAndUpdate(
    filterQuery: QueryFilter<TDocument>,
    update: UpdateQuery<TDocument>,
  ): Promise<TDocument> {
    const document = await this.model
      .findOneAndUpdate(filterQuery, update, {
        lean: true,
        returnDocument: 'after',
      })
      .exec();

    if (!document) {
      this.logger.warn(`Document not found with filterQuery:`, filterQuery);
      throw new NotFoundException('Document not found.');
    }

    return document;
  }

  async upsert(
    filterQuery: QueryFilter<TDocument>,
    document: Partial<TDocument>,
  ) {
    return this.model.findOneAndUpdate(filterQuery, document, {
      lean: true,
      upsert: true,
      returnDocument: 'after',
    });
  }

  async find(filterQuery: QueryFilter<TDocument>) {
    return this.model.find(filterQuery, {}, { lean: true });
  }

  async startTransaction(): Promise<ClientSession> {
    const session = await this.connection.startSession();
    session.startTransaction();
    return session;
  }
}
