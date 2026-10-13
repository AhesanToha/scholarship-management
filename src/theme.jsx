import React from 'react';
import {MantineProvider,createTheme,localStorageColorSchemeManager,Button,Paper,Table} from '@mantine/core';
export const COLOR_SCHEME_KEY='seat-desk-color-scheme';
const colorSchemeManager=localStorageColorSchemeManager({key:COLOR_SCHEME_KEY});
export const theme=createTheme({
 primaryColor:'teal',primaryShade:{light:8,dark:5},
 fontFamily:'Inter, "Segoe UI", system-ui, sans-serif',
 headings:{fontFamily:'Inter, "Segoe UI", system-ui, sans-serif',fontWeight:'700'},
 defaultRadius:'md',
 colors:{teal:['#eaf8f5','#ccefe6','#a4e3d4','#7bd6c1','#58cbae','#40c49f','#30bd96','#1b9e7d','#148c6e','#087b5f'],dark:['#d7e2ed','#b4c2d2','#91a1b4','#627186','#354354','#283444','#1d2836','#17212e','#101923','#0c131d']},
 components:{Button:Button.extend({defaultProps:{radius:'md',size:'sm'}}),Paper:Paper.extend({defaultProps:{radius:'lg',withBorder:true}}),Table:Table.extend({defaultProps:{highlightOnHover:true,horizontalSpacing:'md',verticalSpacing:'sm'}})}
});
export function ThemeProvider({children}){return <MantineProvider theme={theme} defaultColorScheme="light" colorSchemeManager={colorSchemeManager}>{children}</MantineProvider>}
