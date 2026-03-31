#!/bin/bash
# Deploy frontend to Vercel
cd "$(dirname "$0")/frontend"
npx vercel deploy --prod --yes
