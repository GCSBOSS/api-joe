
FROM 'node:12-alpine'
ENV NODE_ENV production

EXPOSE 80
EXPOSE 443

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm i --no-optional -P

COPY . .

#USER api-joe

CMD ["node", "./bin/api-joe.js"]
