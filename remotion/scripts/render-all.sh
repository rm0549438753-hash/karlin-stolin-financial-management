#!/usr/bin/env bash
set -euo pipefail

node scripts/render-remotion.mjs main /mnt/documents/rosenthal-financial-promo-horizontal.mp4
node scripts/render-remotion.mjs main-vertical /mnt/documents/rosenthal-financial-promo-vertical.mp4

ls -lh /mnt/documents/rosenthal-financial-promo-horizontal.mp4 /mnt/documents/rosenthal-financial-promo-vertical.mp4
