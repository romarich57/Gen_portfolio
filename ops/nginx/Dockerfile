FROM nginx:alpine

# Copy nginx configuration
COPY dev_https.conf /etc/nginx/nginx.conf

# Expose HTTPS ports
EXPOSE 3000 4000

CMD ["nginx", "-g", "daemon off;"]
