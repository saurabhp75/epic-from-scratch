# How to use the roles and permissions table

- For now we have two roles, admin and user.
- We want to apply these roles and perms to all new users who are created. This
  means that our db must have them before any user is created. \_ For local dev,
  we can use seed script, but for production we need to have them in migration
  file.

1. Run the script below using "node tmp.ignored.js"
2. Create a dump of all the data in tmp db using sqlite3 using "sqlite3
   ./prisma/tmp.ignored.db .dump > tmp.ignored.sql"
3. Copy only the insert statements from the tmp.ignored.sql in the migration.sql
   file.
4. Update the seed script to assign role to created users.
5. Now reset the db using "npx prisma migrate reset --force"

```prisma

import { PrismaClient } from '@prisma/client'
import { execaCommand } from 'execa'

const datasourceUrl = 'file:./tmp.ignored.db'
console.time('🗄️ Created database...')
await execaCommand('npx prisma migrate deploy', {
 stdio: 'inherit',
 env: { DATABASE_URL: datasourceUrl },
})
console.timeEnd('🗄️ Created datsabase...')

const prisma = new PrismaClient({ datasourceUrl })

console.time('🔑 Created permissions...')
const entities = ['user', 'note']
const actions = ['create', 'read', 'update', 'delete']
const accesses = ['own', 'any']
for (const entity of entities) {
 for (const action of actions) {
  for (const access of accesses) {
   await prisma.permission.create({ data: { entity, action, access } })
  }
 }
}
console.timeEnd('🔑 Created permissions...')

console.time('👑 Created roles...')
await prisma.role.create({
 data: {
  name: 'admin',
  permissions: {
   connect: await prisma.permission.findMany({
    select: { id: true },
    where: { access: 'any' },
   }),
  },
 },
})
await prisma.role.create({
 data: {
  name: 'user',
  permissions: {
   connect: await prisma.permission.findMany({
    select: { id: true },
    where: { access: 'own' },
   }),
  },
 },
})
console.timeEnd('👑 Created roles...')

console.log('✅ all done')
```
