import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// delete all users, this will delete all the notes and images
// associated with the user due to cascade defined in the schema
await prisma.user.deleteMany()

const kody = await prisma.user.create({
	data: {
		email: 'kody@kcd.dev',
		username: 'kody',
		name: 'Kody',
	},
})

await prisma.note.create({
	data: {
		id: 'd27a197e',
		title: 'Basic Koala Facts',
		content:
			'Koalas are found in the eucalyptus forests of eastern Australia. They have grey fur with a cream-coloured chest, and strong, clawed feet, perfect for living in the branches of trees!',
		ownerId: kody.id,
		images: {
			create: [
				{
					altText: 'an adorable koala cartoon illustration',
					contentType: 'image/png',
					blob: await fs.promises.readFile(
						'./tests/fixtures/images/kody-notes/cute-koala.png',
					),
				},
				{
					altText: 'a cartoon illustration of a koala in a tree eating',
					contentType: 'image/png',
					blob: await fs.promises.readFile(
						'./tests/fixtures/images/kody-notes/koala-eating.png',
					),
				},
			],
		},
	},
})
