const STORAGE_UNAVAILABLE_MESSAGE =
  "Extension account storage is unavailable in Web mode"

const rejectWrite = async (): Promise<never> => {
  throw new Error(STORAGE_UNAVAILABLE_MESSAGE)
}

export const accountStorage = {
  getAccountById: async () => null,
  updateSub2ApiAuth: rejectWrite,
  updateAccount: rejectWrite,
}
