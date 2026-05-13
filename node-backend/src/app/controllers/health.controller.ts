import type { Request, Response } from 'express';

export const healthController = (_req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      ready: true,
    },
  });
};
