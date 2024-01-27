// create another session. This one should be just like the one in session.server.ts
// except, the name should be unique (like "en_verification" or something like that)
// and the maxAge should be 10 minutes (60 * 10).
import { createCookieSessionStorage } from '@remix-run/node'

export const verifySessionStorage = createCookieSessionStorage({
	cookie: {
		name: 'en_verification',
		sameSite: 'lax',
		path: '/',
		httpOnly: true,
		maxAge: 60 * 10, // 10 minutes
		secrets: process.env.SESSION_SECRET.split(','),
		secure: process.env.NODE_ENV === 'production',
	},
})
