import { AppDataSource } from '../../../config/database';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../shared/errors';
import { Company } from '../models/Company';
import { CompanyMember, CompanyRole } from '../models/CompanyMember';
import { User } from '../models/User';
import { AuditService } from '../../audit';
import { AddMemberInput, CreateCompanyInput, UpdateCompanyInput } from './companiesSchemas';

export interface CompanyView {
  id: string;
  legalName: string;
  tradeName?: string | null;
  cnpj: string;
  email: string;
  phone?: string | null;
  address: {
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    zip: string;
  };
  verified: boolean;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** The requesting user's role inside the company, when known. */
  myRole?: CompanyRole;
}

export function toCompanyView(company: Company, myRole?: CompanyRole): CompanyView {
  return {
    id: company.id,
    legalName: company.legalName,
    tradeName: company.tradeName,
    cnpj: company.cnpj,
    email: company.email,
    phone: company.phone,
    address: {
      street: company.addressStreet,
      number: company.addressNumber,
      complement: company.addressComplement,
      district: company.addressDistrict,
      city: company.addressCity,
      state: company.addressState,
      zip: company.addressZip,
    },
    verified: company.verified,
    verifiedAt: company.verifiedAt,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    myRole,
  };
}

const MANAGING_ROLES = [CompanyRole.OWNER, CompanyRole.MANAGER];

export class CompaniesService {
  private static get companies() {
    return AppDataSource.getRepository(Company);
  }

  private static get members() {
    return AppDataSource.getRepository(CompanyMember);
  }

  static async create(userId: string, input: CreateCompanyInput): Promise<CompanyView> {
    if (await this.companies.exists({ where: { cnpj: input.cnpj } })) {
      throw new ConflictError(
        'A company with this CNPJ is already registered',
        'CNPJ_ALREADY_REGISTERED',
      );
    }

    const company = await AppDataSource.transaction(async manager => {
      const created = await manager.save(
        manager.create(Company, {
          legalName: input.legalName,
          tradeName: input.tradeName,
          cnpj: input.cnpj,
          email: input.email,
          phone: input.phone,
          addressStreet: input.address.street,
          addressNumber: input.address.number,
          addressComplement: input.address.complement,
          addressDistrict: input.address.district,
          addressCity: input.address.city,
          addressState: input.address.state,
          addressZip: input.address.zip,
          createdBy: userId,
        }),
      );
      await manager.save(
        manager.create(CompanyMember, { companyId: created.id, userId, role: CompanyRole.OWNER }),
      );
      return created;
    });

    return toCompanyView(company, CompanyRole.OWNER);
  }

  static async listMine(userId: string): Promise<CompanyView[]> {
    const memberships = await this.members.find({
      where: { userId },
      relations: { company: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map(membership => toCompanyView(membership.company, membership.role));
  }

  static async getForMember(userId: string, companyId: string): Promise<CompanyView> {
    const membership = await this.requireMembership(userId, companyId);
    return toCompanyView(membership.company, membership.role);
  }

  static async update(
    userId: string,
    companyId: string,
    input: UpdateCompanyInput,
  ): Promise<CompanyView> {
    const membership = await this.requireMembership(userId, companyId);
    this.assertCanManage(membership);

    const company = membership.company;
    if (input.legalName !== undefined) company.legalName = input.legalName;
    if (input.tradeName !== undefined) company.tradeName = input.tradeName ?? null;
    if (input.email !== undefined) company.email = input.email;
    if (input.phone !== undefined) company.phone = input.phone ?? null;
    if (input.address) {
      company.addressStreet = input.address.street;
      company.addressNumber = input.address.number;
      company.addressComplement = input.address.complement ?? null;
      company.addressDistrict = input.address.district;
      company.addressCity = input.address.city;
      company.addressState = input.address.state;
      company.addressZip = input.address.zip;
    }

    return toCompanyView(await this.companies.save(company), membership.role);
  }

  static async listMembers(userId: string, companyId: string) {
    await this.requireMembership(userId, companyId);
    const memberships = await this.members.find({
      where: { companyId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return memberships.map(m => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    }));
  }

  static async addMember(userId: string, companyId: string, input: AddMemberInput) {
    const membership = await this.requireMembership(userId, companyId);
    this.assertOwner(membership);

    const user = await AppDataSource.getRepository(User).findOne({ where: { email: input.email } });
    if (!user) {
      throw new NotFoundError('No user with this email', 'USER_NOT_FOUND');
    }
    if (await this.members.exists({ where: { companyId, userId: user.id } })) {
      throw new ConflictError('This user is already a member', 'MEMBER_ALREADY_EXISTS');
    }

    const created = await this.members.save(
      this.members.create({ companyId, userId: user.id, role: input.role }),
    );
    return { userId: created.userId, name: user.name, email: user.email, role: created.role };
  }

  static async removeMember(
    userId: string,
    companyId: string,
    memberUserId: string,
  ): Promise<void> {
    const membership = await this.requireMembership(userId, companyId);
    this.assertOwner(membership);

    const target = await this.members.findOne({ where: { companyId, userId: memberUserId } });
    if (!target) {
      throw new NotFoundError('Member not found', 'MEMBER_NOT_FOUND');
    }
    if (target.role === CompanyRole.OWNER) {
      throw new ForbiddenError('The owner cannot be removed', 'OWNER_CANNOT_BE_REMOVED');
    }
    await this.members.remove(target);
  }

  /** Admin action: marks a company as verified (or revokes it). */
  static async setVerified(
    adminId: string,
    companyId: string,
    verified: boolean,
  ): Promise<CompanyView> {
    const company = await this.companies.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND');
    }
    const wasVerified = company.verified;
    company.verified = verified;
    company.verifiedAt = verified ? new Date() : null;
    company.verifiedBy = verified ? adminId : null;
    const saved = await this.companies.save(company);
    if (wasVerified !== verified) {
      await AuditService.record({
        actorId: adminId,
        action: verified ? 'company.verify' : 'company.unverify',
        targetType: 'company',
        targetId: companyId,
      });
    }
    return toCompanyView(saved);
  }

  static async listForAdmin(verified?: boolean): Promise<CompanyView[]> {
    const companies = await this.companies.find({
      where: verified === undefined ? {} : { verified },
      order: { createdAt: 'ASC' },
    });
    return companies.map(company => toCompanyView(company));
  }

  /** 404 (not 403) for non-members so company ids cannot be probed. */
  private static async requireMembership(
    userId: string,
    companyId: string,
  ): Promise<CompanyMember> {
    const membership = await this.members.findOne({
      where: { companyId, userId },
      relations: { company: true },
    });
    if (!membership) {
      throw new NotFoundError('Company not found', 'COMPANY_NOT_FOUND');
    }
    return membership;
  }

  private static assertCanManage(membership: CompanyMember): void {
    if (!MANAGING_ROLES.includes(membership.role)) {
      throw new ForbiddenError(
        'Only owners and managers can change the company',
        'COMPANY_ROLE_REQUIRED',
      );
    }
  }

  private static assertOwner(membership: CompanyMember): void {
    if (membership.role !== CompanyRole.OWNER) {
      throw new ForbiddenError('Only the owner can manage members', 'COMPANY_OWNER_REQUIRED');
    }
  }
}
