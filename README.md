# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/c60524be-c5e9-440f-b8d7-a79465a4c216

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/c60524be-c5e9-440f-b8d7-a79465a4c216) and start prompting.
https://tr.tabirly.com/

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/c60524be-c5e9-440f-b8d7-a79465a4c216) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Security Best Practices

This project implements comprehensive security measures:

### Authentication Security
- **Password Requirements**: Minimum 8 characters with uppercase, lowercase, and numbers
- **Input Validation**: All user inputs are validated using Zod schemas
- **Leaked Password Protection**: Should be enabled in Lovable Cloud backend settings

### Database Security
- **Row-Level Security (RLS)**: All tables have proper RLS policies
- **Role-Based Access Control**: Admin roles managed through `user_roles` table
- **Comment Ownership**: Users can only delete their own comments; admins can moderate all

### Input Sanitization
- All user-generated content is sanitized to prevent XSS attacks
- Character limits enforced on all text inputs
- Special characters escaped in HTML output

### Security Monitoring
- Failed authentication attempts are logged
- Suspicious activity patterns are detected
- Security events are tracked in the `logs` table

### First Admin Setup
1. Sign up for an account through `/auth`
2. Open the Lovable Cloud backend panel
3. Navigate to Auth → Users and copy your user ID
4. Go to Database → Tables → `user_roles`
5. Insert a new row:
   - `user_id`: [your user ID]
   - `role`: admin
6. Refresh the page

### Enabling Leaked Password Protection
1. Open Lovable Cloud backend
2. Navigate to Authentication → Policies
3. Enable "Leaked Password Protection"
4. This prevents users from using commonly leaked passwords

### Security Monitoring
The project includes a `security-monitor` edge function that:
- Logs authentication failures
- Detects potential brute force attacks (>5 failed attempts in 5 minutes)
- Monitors comment spam (>5 comments per minute)
- Tracks admin actions for audit trails

All security events are logged to the `logs` table with `scope: 'security'` for easy monitoring.
