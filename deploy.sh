#!/bin/bash
aws s3 sync ./dist/npt-view s3://dev.navalport.com.br/nptView
aws cloudfront create-invalidation --distribution-id E8IH6P6YQAFI1 --paths "/*"
