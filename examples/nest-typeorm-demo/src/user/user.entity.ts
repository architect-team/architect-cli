import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class User {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column()
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

}
