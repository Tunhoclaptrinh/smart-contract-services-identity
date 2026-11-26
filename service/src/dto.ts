import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

/**
 * Request bodies of /auth/* (first layer: shape). AuthService checks the meaning again (password
 * policy, organisation fields from resources.json, who may invite whom), so a direct call is
 * held to the same rules.
 */
const PASSWORD = { minLength: 12, maxLength: 128 };

export class LoginDto {
  @ApiProperty({ example: "sysadmin@scw.vn" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: "Passw0rd!" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;
}

export class DemoLoginDto {
  @ApiProperty()
  @IsString()
  @MaxLength(254)
  email!: string;
}

export class RegisterOrganizationDto {
  @ApiProperty({ example: "Công ty Minh Long" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name!: string;

  @ApiProperty({ example: "ML01" })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
  @MaxLength(40)
  code!: string;

  @ApiProperty({ enum: ["BUYER", "SUPPLIER"] })
  @IsIn(["BUYER", "SUPPLIER"])
  kind!: "BUYER" | "SUPPLIER";

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: "0101234567" })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  taxCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;
}

export class RegisterAdminDto {
  @ApiProperty({ example: "Nguyễn Văn A" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  displayName!: string;

  @ApiProperty({ example: "admin@minhlong.vn" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: PASSWORD.minLength })
  @IsString()
  @MinLength(PASSWORD.minLength)
  @MaxLength(PASSWORD.maxLength)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ type: RegisterOrganizationDto })
  @ValidateNested()
  @Type(() => RegisterOrganizationDto)
  organization!: RegisterOrganizationDto;

  @ApiProperty({ type: RegisterAdminDto })
  @ValidateNested()
  @Type(() => RegisterAdminDto)
  admin!: RegisterAdminDto;
}

export class RefreshDto {
  @ApiPropertyOptional({
    description:
      "Refresh token; the httpOnly cookie sc_refresh is used when absent",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  currentPassword!: string;

  @ApiProperty({ minLength: PASSWORD.minLength })
  @IsString()
  @MinLength(PASSWORD.minLength)
  @MaxLength(PASSWORD.maxLength)
  newPassword!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: "Code from the reset message" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: PASSWORD.minLength })
  @IsString()
  @MinLength(PASSWORD.minLength)
  @MaxLength(PASSWORD.maxLength)
  newPassword!: string;
}

export class AdminResetPasswordDto {
  @ApiProperty({ minLength: PASSWORD.minLength })
  @IsString()
  @MinLength(PASSWORD.minLength)
  @MaxLength(PASSWORD.maxLength)
  password!: string;
}

export class InviteDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  displayName!: string;

  @ApiProperty({ example: "CONTRACT_OWNER" })
  @IsString()
  @MaxLength(40)
  role!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  title?: string;

  @ApiPropertyOptional({
    description:
      "System administrator only; a company administrator always invites into its own",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  organizationId?: string;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @ApiProperty({ minLength: PASSWORD.minLength })
  @IsString()
  @MinLength(PASSWORD.minLength)
  @MaxLength(PASSWORD.maxLength)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(250)
  displayName?: string;
}
