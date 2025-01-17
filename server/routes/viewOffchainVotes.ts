import validateChain from '../util/validateChain';
import { DB } from '../database';
import { AppError, ServerError } from '../util/errors';
import { OffchainVoteAttributes } from '../models/offchain_vote';
import { TypedRequestQuery, TypedResponse, success } from '../types';

export const Errors = {
  InvalidThread: 'Invalid thread',
};

type ViewOffchainVotesReq = { thread_id: string, chain: string };
type ViewOffchainVotesResp = OffchainVoteAttributes[];

const viewOffchainVotes = async (
  models: DB,
  req: TypedRequestQuery<ViewOffchainVotesReq>,
  res: TypedResponse<ViewOffchainVotesResp>
) => {
  // TODO: runtime validation based on params
  //   maybe something like https://www.npmjs.com/package/runtime-typescript-checker
  let chain, error;
  try {
    [chain, error] = await validateChain(models, req.query);
  } catch (err) {
    throw new AppError(err);
  }
  if (error) {
    console.log('It throws an AppError');
    throw new AppError(error);
  }

  if (!req.query.thread_id) {
    throw new AppError(Errors.InvalidThread);
  }

  try {
    const votes = await models.OffchainVote.findAll({
      where: { thread_id: req.query.thread_id, chain: chain.id },
    });
    return success(res, votes.map((v) => v.toJSON()));
  } catch (err) {
    throw new ServerError(err);
  }
};

export default viewOffchainVotes;
