import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(): Promise<SafeUser[]> {
    const users = await this.userRepo.find({
      order: { createdAt: 'DESC' },
    });

    return users.map((u) => {
      // Excluimos passwordHash para no enviarlo al front.
      const { passwordHash: _passwordHash, ...safeUser } = u as User & {
        passwordHash: string;
      };
      return safeUser as SafeUser;
    });
  }

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.userRepo.findOne({ where: { email } });
    if (exists) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email,
      passwordHash,
      name: dto.name,
      role: dto.role ?? 'user',
      isActive: dto.isActive ?? true,
    });

    const saved = await this.userRepo.save(user);

    const { passwordHash: _passwordHash, ...safeUser } = saved as User & {
      passwordHash: string;
    };
    return safeUser as SafeUser;
  }

  async setActive(userId: string, isActive: boolean): Promise<SafeUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.isActive = isActive;
    const saved = await this.userRepo.save(user);
    const { passwordHash: _passwordHash, ...safeUser } = saved as User & {
      passwordHash: string;
    };
    return safeUser as SafeUser;
  }
}

