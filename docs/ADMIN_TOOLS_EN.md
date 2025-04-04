# User Management Tools

## Overview

These tools allow administrators to manage user accounts, including:

- Changing passwords
- Setting user roles
- Activating/deactivating accounts
- Viewing a list of users

## Using the Tools

### Change Password

To change a user's password:

```bash
node scripts/admin-tools.mjs change-password <username> <new-password>
```

Example:

```bash
node scripts/admin-tools.mjs change-password admintest 12345678
```

### Set User Role

To set a user's role:

```bash
node scripts/admin-tools.mjs set-role <username> <role>
```

Available roles:

- `user`: Regular user
- `admin`: Full administrator
- `moderator`: Moderator
- `analyst`: Analyst

Example:

```bash
node scripts/admin-tools.mjs set-role testuser user
```

### Set Account Status

To set a user's account status:

```bash
node scripts/admin-tools.mjs set-status <username> <status>
```

Available statuses:

- `pending`: Awaiting verification
- `verified`: Verified
- `rejected`: Rejected
- `disabled`: Disabled

Example:

```bash
node scripts/admin-tools.mjs set-status testuser verified
```

### List Users

To display a list of all users and their details:

```bash
node scripts/admin-tools.mjs list
```

## Troubleshooting Login Issues

If you encounter issues logging into the admin account (`admintest`), you can use the password change tool to reset it:

```bash
node scripts/admin-tools.mjs change-password admintest 12345678
```

After executing this command, you will be able to log in using:

- Username: `admintest`
- Password: `12345678`

## Updating User Role Type

If you need to change a user's role type (e.g., from regular user to administrator), use:

```bash
node scripts/admin-tools.mjs set-role username admin
```

## Troubleshooting

### "User Not Found" Error

Make sure you're typing the username correctly and check the full list of users with:

```bash
node scripts/admin-tools.mjs list
```

### Database Connection Error

Ensure the `DATABASE_URL` environment variable is properly set. You can check with:

```bash
echo $DATABASE_URL
```

If not available, the program will use the settings embedded in the `.env` file
