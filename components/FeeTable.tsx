/*
 * Original FeeTable code by Felix Weis - WhatTheFee.io
 * https://whatthefee.io/static/js/FeeTable.js
 *
 * Converted to ReactNative + TypeScript by Evan Kaloudis for Zeus
 */
import * as React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Button } from 'react-native-elements';
import FeeUtils from './../utils/FeeUtils';
// import { Cell, Header, Row } from 'react-native-data-table';
import { DataTable } from 'react-native-paper';
import { isEmpty } from 'lodash';
import { inject, observer } from 'mobx-react';

import FeeStore from './../stores/FeeStore';
import SettingsStore from './../stores/SettingsStore';

interface FeeTableProps {
    SettingsStore: SettingsStore;
    FeeStore: FeeStore;
    setFee: (value: string) => void;
}

interface FeeTableState {
    collapsed: boolean;
}

@inject('SettingsStore', 'FeeStore')
@observer
export default class FeeTable extends React.Component<
    FeeTableProps,
    FeeTableState
> {
    state = {
        collapsed: true
    };

    styler(x: number | string) {
        if (x == null || typeof x === 'string') {
            return {
                backgroundColor: 'white',
                alignItems: 'center',
                height: 53,
                width: 53
            };
        }

        const c: any = FeeUtils.gcolor(x / 800);

        return {
            backgroundColor: `hsl(${c[0]}, ${c[1] * 100}%, ${c[2] * 100}%)`,
            alignItems: 'center',
            height: 53,
            width: 53
        };
    }

    repr = (x: number) => Math.exp(x / 100).toFixed(1);

    reprColumn = (x: number) => (x * 100).toFixed(0) + '%';

    reprIndex = (x: number) => x / 6 + 'h';

    openTable = () => {
        this.props.FeeStore.getFees();

        this.setState({
            collapsed: false
        });
    };

    closeTable = () => {
        this.setState({
            collapsed: true
        });
    };

    render() {
        const { collapsed } = this.state;
        const { FeeStore, SettingsStore, setFee } = this.props;
        const { dataFrame, loading } = FeeStore;
        const { settings } = SettingsStore;
        const { theme } = settings;

        const df = dataFrame;
        let headers: any;
        let rows: any;

        if (!isEmpty(df) && !loading) {
            headers =
                df.columns &&
                df.columns.map((columnName: number, index: number) => (
                    <DataTable.Cell
                        style={{
                            backgroundColor:
                                theme === 'dark' ? 'black' : 'white',
                            minWidth: 53,
                            height: 53
                        }}
                        textStyle={{
                            color: theme === 'dark' ? 'white' : 'black'
                        }}
                        key={`item-${index}`}
                    >
                        {this.reprColumn(columnName)}
                    </DataTable.Cell>
                ));

            rows = df.index.map((index: number, i: number) => {
                const cells = df.data[i].map((cell: any, k: number) => {
                    const value = this.repr(cell);
                    return (
                        <TouchableOpacity
                            key={`cell-${k}`}
                            onPress={() => setFee(value)}
                        >
                            <DataTable.Cell style={this.styler(cell)}>
                                <Text style={{ color: 'white' }}>{value}</Text>
                            </DataTable.Cell>
                        </TouchableOpacity>
                    );
                });

                const indexText = this.reprIndex(index);

                return (
                    <DataTable.Row key={`row-${i}`}>
                        <DataTable.Cell style={this.styler(indexText)}>
                            <Text
                                style={{
                                    backgroundColor:
                                        theme === 'dark' ? 'black' : 'white',
                                    color: theme === 'dark' ? 'white' : 'black',
                                    width: 100
                                }}
                            >
                                {indexText}
                            </Text>
                        </DataTable.Cell>
                        {cells}
                    </DataTable.Row>
                );
            });
        }

        return (
            <View style={{ flex: 1 }}>
                <Button
                    title={collapsed ? 'What the Fee?' : 'Hide Fee Table'}
                    icon={{
                        name: 'view-module',
                        size: 25,
                        color: theme === 'dark' ? 'black' : 'white'
                    }}
                    containerStyle={{
                        marginBottom: 20,
                        width: 200,
                        alignSelf: 'center'
                    }}
                    buttonStyle={{
                        backgroundColor: theme === 'dark' ? 'white' : 'black',
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: theme === 'dark' ? 'black' : 'white'
                    }}
                    onPress={() =>
                        collapsed ? this.openTable() : this.closeTable()
                    }
                />
                {!collapsed && loading && (
                    <ActivityIndicator size="large" color="#0000ff" />
                )}
                {!collapsed && !loading && headers && (
                    <View style={{ left: 25 }}>
                        <DataTable.Header
                            style={{ backgroundColor: 'white', left: 15 }}
                            textStyle={{ alignItems: 'center' }}
                        >
                            {headers}
                        </DataTable.Header>
                        {rows}
                    </View>
                )}
            </View>
        );
    }
}
