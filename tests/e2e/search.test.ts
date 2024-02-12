import { expect, test } from '@playwright/test'
import { createUser } from "@/db-utils"
import { prisma } from '~/utils/db.server'

// Run "npx playwright test --ui" to run this test

// create test here, you'll need the "page" fixture.
test('Search from home page', async ({ page }) => {
	// create a new user in the database.
	const userData = createUser()
	const newUser = await prisma.user.create({
		select: { id: true, name: true, username: true },
		data: userData,
	})

	// go to the home page ( "/")
	await page.goto('/')

	// fill in the search box with username ( it's implicit role is "searchbox" and it's named "search")
	await page.getByRole('searchbox', { name: /search/i }).fill(newUser.username)

	// click the search button ( it's named "search")
	await page.getByRole('button', { name: /search/i }).click()

	// wait for the URL to be `/users?search=${newUser.username}`
	// handle encoding this properly using URLSearchParams
	await page.waitForURL(
		`/users?${new URLSearchParams({ search: newUser.username })}`,
	)

	// assert that the text "Epic Notes Users" is visible
	await expect(page.getByText('Epic Notes Users')).toBeVisible()

	// you're looking for a "list" element, but we've got others on the page
	// you can chain queries together like this: page.getByRole('main').getByRole('list')
	// then from there, you can chain another query to get the "listitems" inside the list
	const userList = page.getByRole('main').getByRole('list')

	// get the list of users and assert that there's only one user
	await expect(userList.getByRole('listitem')).toHaveCount(1)

	// assert that the image with alt text "kody" is visible
	await expect(
		page.getByAltText(newUser.name ?? newUser.username),
	).toBeVisible()

	// fill in the search box with "__nonexistent__" ( that shouldn't match anyone)
	await page.getByRole('searchbox', { name: /search/i }).fill('__nonexistent__')

	// click the search button
	await page.getByRole('button', { name: /search/i }).click()

	// wait for the URL to be "/users?search=__nonexistent__"
	await page.waitForURL(`/users?search=__nonexistent__`)

	// get the list of users and assert that there are no users ( query for the listitem and assert not.toBeVisible())
	await expect(userList.getByRole('listitem')).not.toBeVisible()

	// assert that the text "no users found" is visible
	await expect(page.getByText(/no users found/i)).toBeVisible()

	// delete the user you created here
	await prisma.user.delete({ where: { id: newUser.id } })
})
