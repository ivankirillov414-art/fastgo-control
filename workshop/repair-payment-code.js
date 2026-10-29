const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function repairPaymentLink(record){if(!uuid.test(String(record?.id||'')))throw Error('Не удалось определить ремонт');return 'https://ivankirillov414-art.github.io/fastgo-control/workshop.html#order?kind=repair&id='+encodeURIComponent(record.id);}
