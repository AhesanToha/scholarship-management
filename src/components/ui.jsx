import React from 'react';import {Button,TextInput,NativeSelect,Checkbox,Table} from '@mantine/core';
export function ActionButton({className='',type='button',children,...props}){const secondary=className.includes('secondary'),danger=className.includes('danger');return <Button type={type} radius="md" fw={600} variant={secondary?'light':danger?'light':'filled'} color={danger?'red':undefined} className={className} {...props}>{children}</Button>}
export function FieldInput({type='text',...props}){if(['file','hidden'].includes(type))return <input type={type} {...props}/>;if(type==='checkbox')return <Checkbox {...props}/>;return <TextInput type={type} {...props}/>}
export function FieldSelect({children,...props}){return <NativeSelect {...props}>{children}</NativeSelect>}
export function DataTable({children,...props}){return <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md" {...props}>{children}</Table>}
DataTable.Thead=Table.Thead;DataTable.Tbody=Table.Tbody;DataTable.Tr=Table.Tr;DataTable.Th=Table.Th;DataTable.Td=Table.Td;
