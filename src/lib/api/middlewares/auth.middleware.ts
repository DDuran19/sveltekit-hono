import { auth } from '@api/auth';
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { authSchema, processZodError, userFormSchema } from '@types';
import { HTTPException } from 'hono/http-exception';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import type { AppBindings } from '@api';

export const authMiddleware = createMiddleware<AppBindings>(async (c, next) => {
	const sessionId = getCookie(c, auth.sessionCookieName) ?? null;

	if (!sessionId) {
		c.set('session', null);
		c.set('user', null);
		return next();
	}

	const { session, user } = await auth.validateSession(sessionId);
	if (session && session.fresh) {
		c.header('Set-Cookie', auth.createSessionCookie(session.id).serialize(), {
			append: true
		});
	}
	if (!session) {
		c.header('Set-Cookie', auth.createBlankSessionCookie().serialize(), {
			append: true
		});
	}

	c.set('session', session);
	c.set('user', user);
	return next();
});

// TODO: The following guards should also reflect the data from the auth/route.rules module
export const authGuardMiddleware = createMiddleware<AppBindings>(async (c, next) => {
	if (!c.var.user)
		throw new HTTPException(StatusCodes.UNAUTHORIZED, {
			message: ReasonPhrases.UNAUTHORIZED
		});

	return await next();
});
export const adminGuardMiddleware = createMiddleware<AppBindings>(async (c, next) => {
	if (!c.var.user)
		throw new HTTPException(StatusCodes.UNAUTHORIZED, { message: ReasonPhrases.UNAUTHORIZED });

	if (c.var.user && c.var.user.role !== 'admin')
		throw new HTTPException(StatusCodes.UNAUTHORIZED, { message: ReasonPhrases.UNAUTHORIZED });

	return next();
});

export const loginFormValidator = zValidator('form', authSchema, (result, c) => {
	if (!result.success) {
		const response = processZodError('Invalid form', result.error);
		return c.json(response, StatusCodes.BAD_REQUEST);
	}
});

export const signUpFormValidator = zValidator('form', userFormSchema, (result, c) => {
	if (!result.success) {
		const response = processZodError('Invalid form', result.error);
		return c.json(response, StatusCodes.BAD_REQUEST);
	}
});
