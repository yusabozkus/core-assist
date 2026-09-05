import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GlobalSearchQueryDto } from './dto/global-search-query.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(storeId: string, userId: string, query: GlobalSearchQueryDto) {
    const membership = await this.prisma.storeMember.findFirst({
      where: {
        storeId,
        userId,
        store: { status: 'ACTIVE' },
      },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }

    const text = query.query;
    const candidateLimit = query.limit * 3;
    const insensitive = { contains: text, mode: 'insensitive' as const };

    const [products, questions] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          storeId,
          status: 'ACTIVE',
          OR: [
            { title: insensitive },
            { brand: insensitive },
            { category: insensitive },
            {
              variants: {
                some: {
                  status: { not: 'ARCHIVED' },
                  OR: [
                    { sku: insensitive },
                    { barcode: insensitive },
                    { color: insensitive },
                    { size: insensitive },
                  ],
                },
              },
            },
            { externalProducts: { some: { externalId: insensitive } } },
          ],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: candidateLimit,
        select: {
          id: true,
          title: true,
          brand: true,
          category: true,
          updatedAt: true,
          variants: {
            where: {
              status: { not: 'ARCHIVED' },
              OR: [
                { sku: insensitive },
                { barcode: insensitive },
                { color: insensitive },
                { size: insensitive },
              ],
            },
            take: 2,
            select: { sku: true, barcode: true },
          },
          images: {
            take: 1,
            orderBy: { position: 'asc' },
            select: { url: true },
          },
          externalProducts: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            select: { externalId: true },
          },
        },
      }),
      this.prisma.productQuestion.findMany({
        where: {
          storeId,
          OR: [
            { question: insensitive },
            { customerName: insensitive },
            { externalQuestionId: insensitive },
            { product: { title: insensitive } },
          ],
        },
        orderBy: [{ externalCreatedAt: 'desc' }, { id: 'asc' }],
        take: candidateLimit,
        select: {
          id: true,
          question: true,
          customerName: true,
          externalQuestionId: true,
          status: true,
          externalCreatedAt: true,
          product: { select: { title: true } },
          connection: { select: { providerKey: true } },
        },
      }),
    ]);

    const normalizedQuery = normalize(text);
    const productResults = products
      .map((product) => ({
        score: Math.max(
          score(product.title, normalizedQuery, 100),
          score(product.brand, normalizedQuery, 70),
          score(product.category, normalizedQuery, 55),
          ...product.variants.flatMap((variant) => [
            score(variant.sku, normalizedQuery, 95),
            score(variant.barcode, normalizedQuery, 90),
          ]),
          ...product.externalProducts.map((externalProduct) =>
            score(externalProduct.externalId, normalizedQuery, 85),
          ),
        ),
        item: {
          id: product.id,
          title: product.title,
          brand: product.brand,
          category: product.category,
          imageUrl: product.images[0]?.url ?? null,
          matchedIdentifier:
            product.variants.find(
              (variant) =>
                includes(variant.sku, normalizedQuery) ||
                includes(variant.barcode, normalizedQuery),
            )?.sku ?? null,
        },
        date: product.updatedAt,
      }))
      .sort(compareSearchResults)
      .slice(0, query.limit)
      .map(({ item }) => item);

    const questionResults = questions
      .map((question) => ({
        score: Math.max(
          score(question.question, normalizedQuery, 100),
          score(question.customerName, normalizedQuery, 75),
          score(question.externalQuestionId, normalizedQuery, 85),
          score(question.product?.title, normalizedQuery, 65),
        ),
        item: {
          id: question.id,
          question: question.question,
          customerName: question.customerName,
          productTitle: question.product?.title ?? null,
          providerKey: question.connection.providerKey,
          status: question.status,
          externalCreatedAt: question.externalCreatedAt,
        },
        date: question.externalCreatedAt,
      }))
      .sort(compareSearchResults)
      .slice(0, query.limit)
      .map(({ item }) => item);

    return {
      query: text,
      products: productResults,
      questions: questionResults,
      hasMoreProducts: products.length > query.limit,
      hasMoreQuestions: questions.length > query.limit,
    };
  }
}

function normalize(value: string) {
  return value.toLocaleLowerCase('tr-TR').trim();
}

function includes(value: string | null | undefined, normalizedQuery: string) {
  return value ? normalize(value).includes(normalizedQuery) : false;
}

function score(
  value: string | null | undefined,
  normalizedQuery: string,
  weight: number,
) {
  if (!value) return 0;

  const normalizedValue = normalize(value);
  if (normalizedValue === normalizedQuery) return weight + 30;
  if (normalizedValue.startsWith(normalizedQuery)) return weight + 15;
  if (normalizedValue.includes(normalizedQuery)) return weight;
  return 0;
}

function compareSearchResults(
  left: { score: number; date: Date },
  right: { score: number; date: Date },
) {
  return right.score - left.score || right.date.getTime() - left.date.getTime();
}
