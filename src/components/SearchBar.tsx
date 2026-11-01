// Search input with a magnifier icon.
import { Ionicons } from "@expo/vector-icons";
import React from 'react';
import { TextInput, View } from 'react-native';

interface Props{
    placeholder: string;
    onPress?:()=>void;
}

// Search box showing the placeholder text passed in by the screen.
const SearchBar = ({placeholder , onPress}: Props) => {
  return (
    <View className='flex-row items-center bg-dark-200 rounded-full px-5 py-4'>
     <Ionicons name="search" size={20} color="#ab8bff" />
      <TextInput
        onPress={onPress}
        placeholder={placeholder}
        value=''
        onChange={()=>{}}
        placeholderTextColor='white'
        className='flex-1 ml-2 text-white'
      />
    </View>
  )
}

export default SearchBar