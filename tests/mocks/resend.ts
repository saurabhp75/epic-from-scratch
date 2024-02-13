// create and export handlers here
// the type is Array<HttpHandler>
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { faker } from '@faker-js/faker'
import fsExtra from 'fs-extra'
import { HttpResponse, http, type HttpHandler } from 'msw'
import { z } from 'zod'

// handle http.post requests to `https://api.resend.com/emails`
// get the body from await request.json()
// as extra credit, make this typesafe by parsing it with zod
// log out the email body
const { json } = HttpResponse

// return json with the following properties: id, from, to, created_at
// you can use faker to generate the id and new Date().toISOString() for the created_at
const EmailSchema = z.object({
	to: z.string(),
	from: z.string(),
	subject: z.string(),
	text: z.string(),
	html: z.string().optional(),
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const emailFixturesDirPath = path.join(__dirname, '..', 'fixtures', 'email')
await fsExtra.ensureDir(emailFixturesDirPath)

export async function requireEmail(recipient: string) {
	const email = await fsExtra.readJSON(
		path.join(emailFixturesDirPath, `${recipient}.json`),
	)
	// parse with email schema to make TS happy
	return EmailSchema.parse(email)
}

export const handlers: Array<HttpHandler> = [
	http.post(`https://api.resend.com/emails`, async ({ request }) => {
		const email = EmailSchema.parse(await request.json())
		console.info('🔶 mocked email contents:', email)

		// write the email as json to file in "email" directory with
		// filename set to the "to" email address.
		await fsExtra.writeJSON(
			path.join(emailFixturesDirPath, `./${email.to}.json`),
			email,
		)

		return json({
			id: faker.string.uuid(),
			from: email.from,
			to: email.to,
			created_at: new Date().toISOString(),
		})
	}),
]
