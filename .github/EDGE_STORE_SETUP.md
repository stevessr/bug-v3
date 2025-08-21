# Microsoft Edge Store Workflow Setup

This repository includes an automated workflow for building and releasing the emoji extension to the Microsoft Edge Add-ons store.

## Setup Instructions

### 1. Microsoft Edge Store Account Setup

1. **Create a Microsoft Partner Center Account**
   - Go to [Microsoft Partner Center](https://partner.microsoft.com/)
   - Sign up for a developer account
   - Complete the registration process (may require verification)

2. **Register Your Extension**
   - Navigate to "Microsoft Edge" section in Partner Center
   - Create a new extension listing
   - Note down your **Product ID** (you'll need this for the workflow)

### 2. API Credentials Setup

1. **Create Azure AD App Registration**
   - Go to [Azure Portal](https://portal.azure.com/)
   - Navigate to "Azure Active Directory" > "App registrations"
   - Click "New registration"
   - Name: "Edge Store API Access" (or similar)
   - Account types: "Accounts in this organizational directory only"
   - Click "Register"

2. **Configure API Permissions**
   - In your app registration, go to "API permissions"
   - Click "Add a permission"
   - Select "APIs my organization uses"
   - Search for and select "Microsoft Edge Add-ons API"
   - Select "Application permissions"
   - Add the required permissions for package upload
   - Click "Grant admin consent"

3. **Create Client Secret**
   - Go to "Certificates & secrets"
   - Click "New client secret"
   - Add description and set expiration
   - **Copy the secret value immediately** (you won't see it again)

### 3. GitHub Repository Secrets

Add the following secrets to your GitHub repository:

1. Go to your repository settings
2. Navigate to "Secrets and variables" > "Actions"
3. Add these repository secrets:

```
EDGE_CLIENT_ID=<your-azure-app-client-id>
EDGE_CLIENT_SECRET=<your-azure-app-client-secret>
EDGE_ACCESS_TOKEN_URL=https://login.microsoftonline.com/<your-tenant-id>/oauth2/v2.0/token
EDGE_PRODUCT_ID=<your-edge-store-product-id>
```

**Where to find these values:**
- `EDGE_CLIENT_ID`: From your Azure app registration "Overview" page
- `EDGE_CLIENT_SECRET`: The secret you created in step 2.3
- `EDGE_ACCESS_TOKEN_URL`: Replace `<your-tenant-id>` with your Azure AD tenant ID
- `EDGE_PRODUCT_ID`: From your Edge Store extension listing

### 4. Workflow Usage

#### Automatic Release (Recommended)
1. Create and push a git tag:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
2. The workflow will automatically:
   - Build the extension
   - Update version numbers
   - Create a GitHub release
   - Upload to Edge Store

#### Manual Release
1. Go to "Actions" tab in your repository
2. Select "Build and Release to Microsoft Edge Store"
3. Click "Run workflow"
4. Enter the version number (e.g., "1.0.1")
5. Click "Run workflow"

## Workflow Features

- **Automatic Building**: Compiles the Vue.js extension using Vite
- **Version Management**: Updates manifest.json and package.json versions
- **GitHub Releases**: Creates releases with zip files
- **Edge Store Upload**: Automatically uploads the package to Edge Store
- **Artifact Storage**: Saves build artifacts for 30 days

## Troubleshooting

### Common Issues

1. **Access Token Error**
   - Verify all secrets are correctly set
   - Check that your Azure app has the right permissions
   - Ensure tenant ID is correct in the token URL

2. **Upload Failed**
   - Check that your Product ID is correct
   - Verify your extension is properly registered in Partner Center
   - Ensure the package meets Edge Store requirements

3. **Build Errors**
   - Check that your code builds locally first
   - Verify all dependencies are in package.json
   - Check for any missing assets or files

### Manual Submission

If automated upload fails, you can always:
1. Download the zip file from the GitHub release
2. Manually upload it to Partner Center
3. Submit for review through the web interface

## Security Notes

- Never commit API credentials to your repository
- Regularly rotate your client secrets
- Monitor the workflow logs for any security issues
- Use the principle of least privilege for API permissions