import * as bodyParser from "body-parser";
import * as express from "express";
import { Request, Response } from "express";
import { createConnection } from "typeorm";
import { ConnectionManager } from "./connection/connection-manager";
import { User } from "./entity/user";

createConnection(ConnectionManager.getConnectionOptions()).then(async connection => {
    const manager = new ConnectionManager(connection);
    await manager.runDatabaseDdl();

    const userRepository = connection.getRepository(User);

    const app = express();
    app.use(bodyParser.json());

    app.get("/", async function (req: Request, res: Response) {
        const users = await userRepository.find();
        const title = `<h3>Demo is working!</h3>`;
        let userListItems = [];
        for (const user of users) {
            userListItems.push(`<li>${user.lastName}, ${user.firstName}</li>`);
        }
        const userList = userListItems.join('');
        const userSection = `<p>Found ${users.length} users in database:</p><ul>${userList}</ul>`;
        const apiSection = `<p>API endpoints: <ul><li>GET /users</li><li>GET /users/:id</li><li>POST /users</li><li>PUT /users/:id</li><li>DELETE /users/:id</li></ul>`;
        const disclaimer = `<small>This application is purely for demo purposes. See <a href="https://github.com/architect-team/architect-cli/tree/main/examples/database-seeding">README</a> for more.</small>`;
        const response = `<html><body>${title}${disclaimer}${userSection}${apiSection}</body></html>`;
        res.send(response);
    });

    app.get("/users", async function (req: Request, res: Response) {
        const users = await userRepository.find();
        res.json(users);
    });

    app.get("/users/:id", async function (req: Request, res: Response) {
        const results = await userRepository.findOne(req.params.id);
        return res.send(results);
    });

    app.post("/users", async function (req: Request, res: Response) {
        const user = await userRepository.create(req.body);
        const results = await userRepository.save(user);
        return res.send(results);
    });

    app.put("/users/:id", async function (req: Request, res: Response) {
        const user = await userRepository.findOne(req.params.id);
        userRepository.merge(user, req.body);
        const results = await userRepository.save(user);
        return res.send(results);
    });

    app.delete("/users/:id", async function (req: Request, res: Response) {
        const results = await userRepository.delete(req.params.id);
        return res.send(results);
    });

    // start express server
    app.listen(3000);
});
