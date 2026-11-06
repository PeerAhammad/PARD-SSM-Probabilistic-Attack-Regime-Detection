export const REPORTED = {
  head: ['Metric', 'CICIDS2017', 'UNSW-NB15'],
  rows: [
    ['Accuracy', '98.41%', '99.75%'],
    ['Attack precision', '93.95%', '90.13%'],
    ['Attack recall', '98.28%', '99.06%'],
    ['F1-score', '0.9607', '0.9438'],
    ['ROC-AUC', '0.9981', '0.9996'],
    ['PR-AUC', '0.9937', '0.9823'],
    ['Detection lead time', '28.32 ± 14.26 steps', '31.24 ± 13.52 steps'],
  ],
  caveats: [
    'These figures are quoted from the research repository and were not reproduced here.',
    'The processed arrays behind them were randomly sampled (50,000 rows) and stored in shuffled order. We verified that the label of a row is no more likely to match its predecessor than chance, so "sequence" and "lead time" metrics do not reflect real temporal detection.',
    'The processed arrays could not be regenerated from the raw datasets with the repository\'s current loader, so these numbers are shown for transparency only.',
    'Lead time is measured in sequence steps, not seconds, and is not claimed as early detection.',
  ],
}