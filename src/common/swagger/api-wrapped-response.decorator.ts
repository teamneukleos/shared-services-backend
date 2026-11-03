import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiErrorResponseDto, PaginationMetaDto } from './api-envelope.dto';

type WrappedOptions = {
  description?: string;
  isArray?: boolean;
  paginated?: boolean;
  status?: 200 | 201;
};

function buildSuccessSchema(
  model: Type<unknown>,
  options: WrappedOptions,
): Record<string, unknown> {
  const dataSchema = options.isArray
    ? { type: 'array', items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return {
    type: 'object',
    required: ['success', 'message', 'data', 'meta', 'timestamp'],
    properties: {
      success: { type: 'boolean', example: true },
      message: {
        type: 'string',
        example: 'Request completed successfully',
      },
      data: dataSchema,
      meta: options.paginated
        ? { $ref: getSchemaPath(PaginationMetaDto) }
        : { nullable: true, example: null },
      timestamp: { type: 'string', format: 'date-time' },
      requestId: { type: 'string', nullable: true },
    },
  };
}

export function ApiWrappedOkResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: WrappedOptions = {},
) {
  const schema = buildSuccessSchema(model, options);
  const extras = options.paginated
    ? [ApiErrorResponseDto, PaginationMetaDto, model]
    : [ApiErrorResponseDto, model];

  const responseDecorator =
    options.status === 201
      ? ApiCreatedResponse({
          description: options.description,
          schema,
        })
      : ApiOkResponse({
          description: options.description,
          schema,
        });

  return applyDecorators(ApiExtraModels(...extras), responseDecorator);
}

export function ApiStandardErrors() {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto),
    ApiResponse({
      status: 400,
      description: 'Validation or business-rule error',
      type: ApiErrorResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: 'Authentication required or invalid',
      type: ApiErrorResponseDto,
    }),
    ApiResponse({
      status: 403,
      description: 'Missing required permission',
      type: ApiErrorResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Resource not found in the caller organisation',
      type: ApiErrorResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict with existing data',
      type: ApiErrorResponseDto,
    }),
  );
}
