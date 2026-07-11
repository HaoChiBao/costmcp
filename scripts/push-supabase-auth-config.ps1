# Push production auth redirect URLs to the hosted Supabase project.
# Requires: npx supabase login  (or set SUPABASE_ACCESS_TOKEN)
#
# Usage:
#   npx supabase login
#   ./scripts/push-supabase-auth-config.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Pushing auth config to bylrekkhwcwosdmcgfsg..."
npx --yes supabase@latest config push --project-ref bylrekkhwcwosdmcgfsg --yes

Write-Host "Done. Verify at:"
Write-Host "https://supabase.com/dashboard/project/bylrekkhwcwosdmcgfsg/auth/url-configuration"
