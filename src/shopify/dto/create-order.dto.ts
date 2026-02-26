import { PriceRequestDto } from "./../../pricing/dto/price-request.dto";
import { Customer } from "./../../pricing/dto/price-breakdown.dto";
import {
  IsString,
  IsEmail,
  IsOptional,
  ValidateNested,
  IsBoolean,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

class CustomerDto implements Partial<Customer> {
  @ApiProperty({
    description: "Customer's first name.",
    example: "John",
    required: false,
  })
  @IsString()
  @IsOptional()
  firstName: string;

  @ApiProperty({
    description: "Customer's last name.",
    example: "Doe",
    required: false,
  })
  @IsString()
  @IsOptional()
  lastName: string;

  @ApiProperty({
    description: "Customer's email address.",
    example: "john.doe@example.com",
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email: string;

  @ApiProperty({
    description: "Customer's phone number.",
    example: "123456789",
    required: false,
  })
  @IsString()
  @IsOptional()
  phone: string;

  @ApiProperty({
    description: "The company of the customer.",
    example: "ACME Inc.",
    required: false,
  })
  @IsString()
  @IsOptional()
  company: string;

  @ApiProperty({
    description: "The first line of the customer's shipping address.",
    example: "123 Main St",
    required: false,
  })
  @IsString()
  @IsOptional()
  address1: string;

  @ApiProperty({
    description:
      "The second line of the customer's shipping address (e.g., apartment, suite).",
    example: "Apt 4B",
    required: false,
  })
  @IsString()
  @IsOptional()
  address2: string;

  @ApiProperty({
    description: "The city of the customer's shipping address.",
    example: "Anytown",
    required: false,
  })
  @IsString()
  @IsOptional()
  city: string;

  @ApiProperty({
    description: "The ZIP or postal code of the customer's shipping address.",
    example: "12345",
    required: false,
  })
  @IsString()
  @IsOptional()
  zip: string;

  @ApiProperty({
    description:
      "The two-letter country code of the customer's shipping address.",
    example: "US",
    required: false,
  })
  @IsString()
  @IsOptional()
  countryCode: string;

  @ApiProperty({
    description: "Additional notes for the order.",
    example: "This is a test order.",
    required: false,
  })
  @IsString()
  @IsOptional()
  notes: string;

  @ApiProperty({
    description: "The type of filament to be used.",
    example: "PLA",
    required: false,
  })
  @IsString()
  @IsOptional()
  filamentType: string;

  @ApiProperty({
    description: "The color of the filament.",
    example: "Black",
    required: false,
  })
  @IsString()
  @IsOptional()
  color: string;

  @ApiProperty({
    description: "The number of items to print.",
    example: 1,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  amount: number;

  @ApiProperty({
    description: "The delivery method.",
    example: "pickup",
    required: false,
  })
  @IsString()
  @IsOptional()
  delivery: string;

  @ApiProperty({
    description: "The payment method.",
    example: "cash",
    required: false,
  })
  @IsString()
  @IsOptional()
  payment: string;

  @ApiProperty({
    description: "Whether an invoice is required.",
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  invoice: boolean;

  @ApiProperty({
    description: "Whether the terms and conditions have been accepted.",
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  terms: boolean;
}

export class CreateOrderDto {
  @ApiProperty({
    description: "The name of the temp STL file kept in BE data.",
    example: "upload-1758657443441-270817965.stl",
  })
  @IsString()
  tempFilename: string;

  @ApiProperty({
    description: "The name of the temp STL file used for price calculation.",
    example: "upload-1758657443441-270817965.stl",
  })
  @IsString()
  tempFilename: string;

  @ApiProperty({ description: "The pricing options for the print." })
  @ValidateNested()
  @Type(() => PriceRequestDto)
  options: PriceRequestDto;

  @ApiProperty({ description: "The customer's details." })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;
}
