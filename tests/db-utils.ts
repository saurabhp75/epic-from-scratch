import { faker } from "@faker-js/faker"
import { UniqueEnforcer } from "enforce-unique"

const uniqueUsernameEnforcer = new UniqueEnforcer()

export function createUser() {
	const firstName = faker.person.firstName()
	const lastName = faker.person.lastName()

	// you might add a tiny bit of random alphanumeric characters to the start
	// of the username to reduce the chance of collisions.

	// transform the username to only be the first 20 characters
	// you can use .slice(0, 20) for this
	// turn the username to lowercase
	// replace any non-alphanumeric characters with an underscore
	const username = uniqueUsernameEnforcer
		.enforce(() => {
			return (
				faker.string.alphanumeric({ length: 2 }) +
				'_' +
				faker.internet.userName({
					firstName: firstName.toLowerCase(),
					lastName: lastName.toLowerCase(),
				})
			)
		})
		.slice(0, 20)
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '_')

	return {
		username,
		name: `${firstName} ${lastName}`,
		email: `${username}@example.com`,
	}
}
