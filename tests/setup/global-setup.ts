import path from 'node:path'
import { execaCommand } from 'execa'
import fsExtra from 'fs-extra'

// create and export a BASE_DATABASE_PATH that points to path.join(process.cwd(), './tests/prisma/base.db')
export const BASE_DATABASE_PATH = path.join(
	process.cwd(),
	`./tests/prisma/base.db`,
)

// export an async function called "setup" which does the following:
// check whether the database already exists (fsExtra.pathExists(BASE_DATABASE_PATH)) and returns early if it does
// runs the prisma migrate command we used to have in db-setup.ts
// make sure to set the DATABASE_URL: `file:${BASE_DATABASE_PATH}`, in the env object of the command
export async function setup() {
	const databaseExists = await fsExtra.pathExists(BASE_DATABASE_PATH)
	if (databaseExists) return

	await execaCommand(
		'prisma migrate reset --force --skip-seed --skip-generate',
		{
			stdio: 'inherit',
			env: {
				...process.env,
				DATABASE_URL: `file:${BASE_DATABASE_PATH}`,
			},
		},
	)
}
