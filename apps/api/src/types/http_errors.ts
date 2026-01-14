export class HttpError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
        Object.setPrototypeOf(this, HttpError.prototype);
    }
}

export class BadRequestError extends HttpError {
    constructor(message: string = 'Bad Request') {
        super(message, 400);
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}

export class UnauthorizedError extends HttpError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401);
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}

export class ForbiddenError extends HttpError {
    constructor(message: string = 'Forbidden') {
        super(message, 403);
        Object.setPrototypeOf(this, ForbiddenError.prototype);
    }
}

export class NotFoundError extends HttpError {
    constructor(message: string = 'Not Found') {
        super(message, 404);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

export class ConflictError extends HttpError {
    constructor(message: string = 'Conflict') {
        super(message, 409);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

export class InternalServerError extends HttpError {
    constructor(message: string = 'Internal Server Error') {
        super(message, 500);
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}
