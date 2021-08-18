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
import { themeColor } from './../utils/ThemeUtils';

import { DataTable } from 'react-native-paper';
import isEmpty from 'lodash/isEmpty';
import { inject, observer } from 'mobx-react';

import FeeStore from './../stores/FeeStore';

interface FeeTableProps {
    FeeStore: FeeStore;
    setFee: (value: string) => void;
}

interface FeeTableState {
    collapsed: boolean;
}

@inject('FeeStore')
@observer
export default class FeeTable extends React.Component<
    FeeTableProps,
    FeeTableState
> {
    state = {
        collapsed: true
    };

    styler(x: number | string): any {
        if (x == null || typeof x === 'string') {
            return {
                backgroundColor: 'white',
                alignItems: 'center',
                height: 27,
                width: 6,
                marginTop: 18
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
        this.props.FeeStore.getOnchainFees();

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
        const { FeeStore, setFee } = this.props;
        const { dataFrame, loading } = FeeStore;

        const df = dataFrame;
        let headers: any;
        let rows: any;

        if (!isEmpty(df) && !loading) {
            headers =
                df.columns &&
                df.columns.map((columnName: number, index: number) => (
                    <DataTable.Cell
                        style={{
                            backgroundColor: 'white',
                            minWidth: 53,
                            height: 53
                        }}
                        key={`item-${index}`}
                    >
                        {this.reprColumn(columnName)}
                    </DataTable.Cell>
                ));

            rows = df.index.map((index: number, i: number) => {
                const cells = df.data[i].map((cell: any, k: number) => {
                    const value = FeeUtils.roundFee(this.repr(cell));
                    return (
                        <TouchableOpacity
                            key={`cell-${k}`}
                            onPress={() => setFee(value)}
                        >
                            <DataTable.Cell style={this.styler(cell)}>
                                <Text
                                    style={{ color: 'white' }}
                                >{`    ${value}`}</Text>
                            </DataTable.Cell>
                        </TouchableOpacity>
                    );
                });

                const indexText = this.reprIndex(index);

                return (
                    <DataTable.Row key={`row-${i}`}>
                        <View style={this.styler(indexText)}>
                            <Text
                                style={{
                                    backgroundColor: themeColor('background'),
                                    color: themeColor('text'),
                                    width: 100
                                }}
                            >
                                {indexText}
                            </Text>
                        </View>
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
                        color: themeColor('background')
                    }}
                    containerStyle={{
                        marginBottom: 20,
                        width: 200,
                        alignSelf: 'center'
                    }}
                    buttonStyle={{
                        backgroundColor: themeColor('text'),
                        borderRadius: 30
                    }}
                    titleStyle={{
                        color: themeColor('background')
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
                            style={{
                                backgroundColor: 'white',
                                left: 15,
                                alignItems: 'center'
                            }}
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
