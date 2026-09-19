import { Request, Response } from 'express';
import { CompaniesService } from './companiesService';

const userId = (req: Request): string => req.userId as string;

export const companiesController = {
  async create(req: Request, res: Response) {
    const company = await CompaniesService.create(userId(req), req.body);
    res.status(201).json({ message: 'Company registered successfully', company });
  },

  async listMine(req: Request, res: Response) {
    res.json({ companies: await CompaniesService.listMine(userId(req)) });
  },

  async getById(req: Request, res: Response) {
    res.json({ company: await CompaniesService.getForMember(userId(req), req.params.id) });
  },

  async update(req: Request, res: Response) {
    const company = await CompaniesService.update(userId(req), req.params.id, req.body);
    res.json({ message: 'Company updated successfully', company });
  },

  async listMembers(req: Request, res: Response) {
    res.json({ members: await CompaniesService.listMembers(userId(req), req.params.id) });
  },

  async addMember(req: Request, res: Response) {
    const member = await CompaniesService.addMember(userId(req), req.params.id, req.body);
    res.status(201).json({ message: 'Member added successfully', member });
  },

  async removeMember(req: Request, res: Response) {
    await CompaniesService.removeMember(userId(req), req.params.id, req.params.userId);
    res.json({ message: 'Member removed successfully' });
  },
};

export const adminCompaniesController = {
  async list(req: Request, res: Response) {
    const { verified } = req.query;
    const filter = verified === 'true' ? true : verified === 'false' ? false : undefined;
    res.json({ companies: await CompaniesService.listForAdmin(filter) });
  },

  async setVerification(req: Request, res: Response) {
    const company = await CompaniesService.setVerified(userId(req), req.params.id, req.body.verified);
    res.json({ message: 'Company verification updated', company });
  },
};
