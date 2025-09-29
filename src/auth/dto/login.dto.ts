import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsInt()
  id: number;

  @IsString()
  @IsNotEmpty()
  password: string;
}
