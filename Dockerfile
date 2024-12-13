FROM node:18-alpine

WORKDIR /app
COPY package*.json ./

# Install build tools for native packages if needed
RUN apk update && apk add --no-cache python3 make g++

# Run npm install without the cache clean first to isolate issues
RUN npm install

COPY . .

CMD ["npm", "start"]