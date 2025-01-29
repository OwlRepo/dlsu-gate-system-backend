import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ example: 'usr_123', description: 'User ID' })
  id: string;

  @ApiProperty({ example: 'johndoe', description: 'Username' })
  username: string;

  @ApiProperty({
    enum: ['admin', 'employee', 'super-admin'],
    description: 'User type',
  })
  userType: 'admin' | 'employee' | 'super-admin';
}
