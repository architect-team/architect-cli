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
